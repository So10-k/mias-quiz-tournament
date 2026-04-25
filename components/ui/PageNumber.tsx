type Props = { value: string | number };

export function PageNumber({ value }: Props) {
  return (
    <span className="font-hand text-caption-md text-ink-muted">{value}</span>
  );
}
