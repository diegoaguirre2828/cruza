import { B2BNav } from '@/components/B2BNav';
import { OnboardingWizard } from './OnboardingWizard';
import { B2B_EN } from '@/lib/copy/b2b-en';
import { B2B_ES } from '@/lib/copy/b2b-es';

export const metadata = {
  title: 'Get started — Cruzar B2B',
  description: 'Set up your Cruzar Insights account in 2 minutes.',
};

export default async function B2BStartPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang: 'en' | 'es' = params?.lang === 'es' ? 'es' : 'en';
  const c = lang === 'es' ? B2B_ES : B2B_EN;

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <B2BNav lang={lang} />
      <OnboardingWizard lang={lang} copy={c.wizard} />
    </div>
  );
}
