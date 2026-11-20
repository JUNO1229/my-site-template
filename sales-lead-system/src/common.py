"""공통 유틸: 인코딩 감지, 전화번호 정규화."""
import re
import pandas as pd


def read_public_csv(path: str) -> pd.DataFrame:
    """공공데이터포털 CSV는 대개 cp949. utf-8 먼저 시도 후 cp949."""
    for enc in ("utf-8-sig", "cp949"):
        try:
            return pd.read_csv(path, encoding=enc, dtype=str)
        except UnicodeDecodeError:
            continue
    raise ValueError(f"인코딩을 판별할 수 없습니다: {path}")


def normalize_phone(p) -> str:
    """숫자만 추출해 한국 전화번호 형식으로. 8자리 중 15/16/18xx 외에는 지역번호 누락으로 표시."""
    if p is None or (isinstance(p, float) and pd.isna(p)):
        return ""
    d = re.sub(r"\D", "", str(p))
    if not d:
        return ""
    if len(d) == 8:
        if d[:2] in ("15", "16", "18"):
            return f"{d[:4]}-{d[4:]}"
        return f"지역번호 확인필요 ({d[:4]}-{d[4:]})"
    if d.startswith("02") and len(d) >= 9:
        return f"{d[:2]}-{d[2:-4]}-{d[-4:]}"
    if len(d) in (10, 11) and d.startswith("0"):
        return f"{d[:3]}-{d[3:-4]}-{d[-4:]}"
    return d


def load_config(name: str = "grading.yaml") -> dict:
    """config/ 의 YAML 설정을 읽는다."""
    import os
    import yaml
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "config", name)
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)
