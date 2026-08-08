-- Keep public.profiles in sync with Supabase Auth users.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user() RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
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

DROP TRIGGER IF EXISTS trg_create_profile_for_auth_user ON auth.users;
CREATE TRIGGER trg_create_profile_for_auth_user
  AFTER INSERT OR UPDATE OF email, raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_auth_user();

INSERT INTO public.profiles (id, email, display_name, avatar_url, created_at)
SELECT
  users.id,
  users.email,
  COALESCE(users.raw_user_meta_data->>'full_name', users.raw_user_meta_data->>'name'),
  users.raw_user_meta_data->>'avatar_url',
  COALESCE(users.created_at, now())
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
  avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url);
