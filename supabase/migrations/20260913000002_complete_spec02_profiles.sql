-- Complete SPEC-02 profile defaults for email and OAuth signups.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user() RETURNS trigger AS $$
DECLARE
  normalized_email text := lower(trim(COALESCE(NEW.email, '')));
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      NULLIF(split_part(normalized_email, '@', 1), '')
    ),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''),
      CASE WHEN normalized_email <> ''
        THEN 'https://www.gravatar.com/avatar/' || md5(normalized_email) || '?d=404'
        ELSE '/default-avatar.svg'
      END
    ),
    COALESCE(NEW.created_at, now())
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;