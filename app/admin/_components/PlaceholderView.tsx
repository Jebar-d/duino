export function PlaceholderView({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="adm-ph">
        <div>
          <div className="adm-ph-title">{title}</div>
          <div className="adm-ph-sub">{description}</div>
        </div>
      </div>

      <div className="adm-tw">
        <div className="adm-empty">
          This section will be connected to the PHP API next.
        </div>
      </div>
    </div>
  );
}
