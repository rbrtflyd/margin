import ConvexHome from '@/components/ConvexHome';
import Margin from '@/components/Margin';
import { isConvexConfigured } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default function Page() {
  if (!isConvexConfigured()) return <Margin user={null} />;
  return <ConvexHome />;
}
