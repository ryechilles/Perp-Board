'use client';

interface FooterProps {
  className?: string;
}

/** Footnote row: copyright (sits under the sidebar). */
export function Footer({ className = '' }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={`flex items-center px-1 py-1 ${className}`}>
      <span className="text-[0.6875rem] text-faint">
        © {currentYear} Perp Board
      </span>
    </footer>
  );
}
