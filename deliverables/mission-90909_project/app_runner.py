"""
[MODULE 2 · SUB-BUILDER (Google Antigravity 계정 2)]
파이썬 미니 가계부 실행 및 단위 테스트 검증 러너
Mission ID: mission-90909
"""
from __future__ import annotations
import unittest
from core_module import MiniBookkeeping


class BookkeepingTestSuite(unittest.TestCase):
    def setUp(self) -> None:
        self.book = MiniBookkeeping()
        self.book.add_transaction("income", 3000000, "급여", "정기 급여")
        self.book.add_transaction("income", 200000, "부수입", "중고 거래")
        self.book.add_transaction("expense", 520000, "식비", "식자재/외식")
        self.book.add_transaction("expense", 180000, "통신/공과금", "관리비 및 통신비")
        self.book.add_transaction("expense", 100000, "교통", "교통카드")

    def test_totals_and_balance(self) -> None:
        self.assertEqual(self.book.get_total_income(), 3200000)
        self.assertEqual(self.book.get_total_expense(), 800000)
        self.assertEqual(self.book.get_balance(), 2400000)

    def test_category_stats(self) -> None:
        stats = self.book.get_category_stats("expense")
        self.assertEqual(stats["식비"], 520000)
        self.assertEqual(stats["통신/공과금"], 180000)
        self.assertEqual(stats["교통"], 100000)


if __name__ == "__main__":
    demo = MiniBookkeeping()
    demo.add_transaction("income", 3200000, "급여")
    demo.add_transaction("expense", 520000, "식비")
    demo.add_transaction("expense", 180000, "통신/공과금")
    demo.add_transaction("expense", 100000, "교통")
    print(demo.format_report())

    suite = unittest.defaultTestLoader.loadTestsFromTestCase(BookkeepingTestSuite)
    result = unittest.TextTestRunner(verbosity=1).run(suite)
    if not result.wasSuccessful():
        raise SystemExit(1)
    print("[VERIFY_PASS] 모든 단위 테스트(2/2) 및 통계 리포트 검증 완료!")
