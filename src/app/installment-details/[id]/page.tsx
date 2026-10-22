import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { InstallmentDetailPage } from '@/components/installments/installment-detail-page';
import { createClient } from '@/lib/supabase/server';
import { decodeLegacyInstallmentId, getInstallmentDetailsUrl, isInstallmentShortId } from '@/lib/utils/installment-url';

type InstallmentDetailsRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function InstallmentDetailsRoute({ params }: InstallmentDetailsRouteProps) {
  const { id } = await params;
  if (isInstallmentShortId(id)) {
    return <InstallmentDetailPage shortId={id} />;
  }

  const legacyUuid = decodeLegacyInstallmentId(id);
  if (!legacyUuid) notFound();

  const supabase = await createClient();
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) redirect('/login');

  const { data, error } = await supabase
    .from('installments')
    .select('short_id')
    .eq('id', legacyUuid)
    .single();
  if (error || !data?.short_id) notFound();

  permanentRedirect(getInstallmentDetailsUrl(data.short_id));
}
