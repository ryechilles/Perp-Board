import OkxBoard from '@/components/board/OkxBoard';
import { BoardPreloads } from '@/components/board/BoardPreloads';

export default function OkxPage() {
  return (
    <>
      <BoardPreloads exchange="okx" />
      <OkxBoard />
    </>
  );
}
