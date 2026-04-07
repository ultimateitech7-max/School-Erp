interface ModulePlaceholderProps {
  title: string;
  description: string;
}

export function ModulePlaceholder({
  title,
  description,
}: ModulePlaceholderProps) {
  return (
    <section className="page-header card">
      <span className="eyebrow">Module</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  );
}

