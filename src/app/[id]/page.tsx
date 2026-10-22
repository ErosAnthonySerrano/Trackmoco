import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getInstallmentDetailsUrl, isInstallmentUuid } from '@/lib/utils/installment-url';

type LegacyDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function LegacyInstallmentDetailPage({ params }: LegacyDetailPageProps) {
  const { id } = await params;
  if (!isInstallmentUuid(id)) notFound();

  const supabase = await createClient();
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) redirect('/login');

  const { data, error } = await supabase
    .from('installments')
    .select('short_id')
    .eq('id', id)
    .single();
  if (error || !data?.short_id) notFound();

  permanentRedirect(getInstallmentDetailsUrl(data.short_id));
}
