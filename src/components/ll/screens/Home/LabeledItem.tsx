export default function LabeledItem({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center flex-1 whitespace-nowrap">
      <span className="mr-2 text-[11px] font-bold tracking-wide text-gray-500 uppercase">
        {label}
      </span>{' '}
      <span>{children}</span>
    </div>
  );
}
