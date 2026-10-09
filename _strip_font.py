from pathlib import Path

root = Path(__file__).resolve().parent
count = 0
for path in root.rglob("*.tsx"):
    if "node_modules" in path.parts:
        continue
    text = path.read_text(encoding="utf-8")
    new = (
        text.replace(' font="normal"', "")
        .replace('font="normal" ', "")
        .replace('font="normal"', "")
    )
    if new != text:
        path.write_text(new, encoding="utf-8")
        count += 1
        print(path.relative_to(root))
print("updated", count)
