import PerpBoard from '@/components/PerpBoard';
import { BoardPreloads } from '@/components/BoardPreloads';

export default function OkxPage() {
  return (
    <>
      <BoardPreloads exchange="okx" />
      <PerpBoard />
    </>
  );
}
