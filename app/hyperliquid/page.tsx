import HyperliquidBoard from '@/components/board/HyperliquidBoard';
import { BoardPreloads } from '@/components/board/BoardPreloads';

export default function HyperliquidPage() {
  return (
    <>
      <BoardPreloads exchange="hyperliquid" />
      <HyperliquidBoard />
    </>
  );
}
