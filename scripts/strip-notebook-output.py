import json
import sys
from pathlib import Path


def strip_notebook(path_str: str) -> bool:
    path = Path(path_str)
    if not path.exists():
        return False

    notebook = json.loads(path.read_text(encoding="utf-8"))
    changed = False

    for cell in notebook.get("cells", []):
        if cell.get("cell_type") != "code":
            continue

        if cell.get("outputs"):
            cell["outputs"] = []
            changed = True

        if cell.get("execution_count") is not None:
            cell["execution_count"] = None
            changed = True

    if changed:
        path.write_text(
            json.dumps(notebook, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8"
        )

    return changed


def main() -> int:
    changed_files = []

    for path_str in sys.argv[1:]:
        if strip_notebook(path_str):
            changed_files.append(path_str)

    if changed_files:
        print("Stripped notebook outputs:")
        for path_str in changed_files:
            print(f"  {path_str}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
