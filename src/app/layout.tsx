import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import '../styles/gradients.css';
import '../styles/custom.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Im Listening',
  description: 'Voice transcription and semantic search application',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}
