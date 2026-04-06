export default function BookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ds-body-bg text-ds-ink antialiased">
      {children}
    </div>
  );
}
