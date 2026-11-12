import HyperliquidBoard from '@/components/HyperliquidBoard';
import { BoardPreloads } from '@/components/BoardPreloads';

export default function HyperliquidPage() {
  return (
    <>
      <BoardPreloads exchange="hyperliquid" />
      <HyperliquidBoard />
    </>
  );
}
