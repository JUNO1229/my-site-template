import os, sys, shutil
import pandas as pd
import pytest
ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, f"{ROOT}/src")
import build_master, ingest_extra, analysis, leaddb as L


@pytest.fixture
def built(tmp_path, monkeypatch):
    extra = tmp_path / "extra"; extra.mkdir()
    pd.DataFrame({"야영장명": ["테스트글램핑", "작은캠핑장"], "소재지도로명주소": ["강원도 춘천시 a 1", "충청북도 단양군 b 2"],
                  "전화번호": ["033-111-2222", ""], "시설면적": ["5000", "500"]}).to_csv(extra / "camping.csv", index=False, encoding="cp949")
    (tmp_path / "data" / "raw").mkdir(parents=True)
    pd.DataFrame({"name": ["작은캠핑장"], "year": ["2025"], "visitors": ["1500000"]}).to_csv(tmp_path / "data" / "raw" / "visitors.csv", index=False)
    monkeypatch.setattr(ingest_extra, "EXTRA", str(extra))
    monkeypatch.setattr(ingest_extra, "ROOT", str(tmp_path))
    p = str(tmp_path / "l.db"); build_master.build(p)
    return L.connect(p)


def test_extra_source_loaded_graded_and_upgraded(built):
    r = dict((n, (g, c)) for n, g, c in built.execute("SELECT l.name,l.grade,(SELECT value FROM contacts WHERE lead_id=l.id) FROM leads l WHERE facility_kind='캠핑장'"))
    assert r["테스트글램핑"] == ("A", "033-111-2222")   # 이름 키워드 A
    assert r["작은캠핑장"][0] == "A"                    # 방문객 150만 → 상향
    assert built.execute("SELECT visitors FROM visitor_stats").fetchone()[0] == 1500000


def test_upgrade_never_downgrades():
    assert ingest_extra.upgraded("A", 10, {"to_A": 100, "to_B": 50}) == "A"
    assert ingest_extra.upgraded("C", 60, {"to_A": 100, "to_B": 50}) == "B"


def test_suggest_points_and_summaries(built):
    lid = built.execute("SELECT id FROM leads WHERE name='테스트글램핑'").fetchone()[0]
    s = analysis.suggest_points(built, lid)
    assert {x["category"] for x in s} >= {"facility_ops", "rental"}
    L.add_sales_point(built, lid, s[0]["point"], s[0]["category"])
    assert s[0]["point"] not in [x["point"] for x in analysis.suggest_points(built, lid)]
    assert len(analysis.points_summary(built)) == 1
    assert "캠핑장" in analysis.kind_coverage(built)["유형"].tolist()
    assert "A" in analysis.funnel(built).index


def test_missing_files_skipped(tmp_path):
    p = str(tmp_path / "l.db"); build_master.build(p)   # 확대 파일 없는 기본 상태에서도 정상
    assert L.connect(p).execute("SELECT COUNT(*) FROM leads").fetchone()[0] > 700
