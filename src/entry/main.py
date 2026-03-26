import sys
from pathlib import Path


LAUNCHER_DIR = Path(__file__).resolve().parent
SRC_PATH = LAUNCHER_DIR.parent

if str(SRC_PATH) not in sys.path:
    sys.path.insert(0, str(SRC_PATH))

from einstein_backend.cli import main


if __name__ == "__main__":
    raise SystemExit(main())
