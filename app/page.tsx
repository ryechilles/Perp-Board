import OkxBoard from '@/components/board/OkxBoard';
import { BoardPreloads } from '@/components/board/BoardPreloads';

// The home page IS the OKX board (the default exchange). It used to redirect to
// /okx, which cost every visitor an extra round trip through the Worker before
// any HTML arrived. /okx stays as the board's named address.
export default function Home() {
  return (
    <>
      <BoardPreloads exchange="okx" />
      <OkxBoard />
    </>
  );
}
