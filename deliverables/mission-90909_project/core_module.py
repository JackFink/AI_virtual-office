"""
[MODULE 1 · BUILDER (Google Antigravity 계정 1)]
파이썬 미니 가계부 핵심 엔진 모듈 (수입/지출 내역 계산 및 카테고리별 통계 리포트)
Mission ID: mission-90909
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List


@dataclass
class Transaction:
    tx_type: str      # 'income' | 'expense'
    amount: int
    category: str
    memo: str = ""


@dataclass
class MiniBookkeeping:
    transactions: List[Transaction] = field(default_factory=list)

    def add_transaction(self, tx_type: str, amount: int, category: str, memo: str = "") -> None:
        norm_type = tx_type.lower().strip()
        if norm_type not in ("income", "expense"):
            raise ValueError(f"지원하지 않는 거래 유형입니다: {tx_type}")
        if amount < 0:
            raise ValueError("금액은 0 이상이어야 합니다.")
        self.transactions.append(Transaction(norm_type, int(amount), category.strip(), memo.strip()))

    def get_total_income(self) -> int:
        return sum(t.amount for t in self.transactions if t.tx_type == "income")

    def get_total_expense(self) -> int:
        return sum(t.amount for t in self.transactions if t.tx_type == "expense")

    def get_balance(self) -> int:
        return self.get_total_income() - self.get_total_expense()

    def get_category_stats(self, tx_type: str = "expense") -> Dict[str, int]:
        stats: Dict[str, int] = {}
        for t in self.transactions:
            if t.tx_type == tx_type:
                stats[t.category] = stats.get(t.category, 0) + t.amount
        return dict(sorted(stats.items(), key=lambda kv: kv[1], reverse=True))

    def format_report(self) -> str:
        inc = self.get_total_income()
        exp = self.get_total_expense()
        bal = self.get_balance()
        cat_stats = self.get_category_stats("expense")
        lines = [
            "==========================================",
            "📊 미니 가계부 수입/지출 및 카테고리 통계",
            "==========================================",
            f"- 총 수입 (Income) : {inc:,}원",
            f"- 총 지출 (Expense): {exp:,}원",
            f"- 현재 잔액 (Balance): {bal:,}원",
            "------------------------------------------",
            "[카테고리별 지출 비중]",
        ]
        for cat, amt in cat_stats.items():
            pct = (amt / exp * 100.0) if exp > 0 else 0.0
            lines.append(f"  * {cat}: {amt:,}원 ({pct:.1f}%)")
        lines.append("==========================================")
        return "\n".join(lines)


if __name__ == "__main__":
    book = MiniBookkeeping()
    book.add_transaction("income", 3500000, "급여", "월급")
    book.add_transaction("expense", 450000, "식비", "장보기 및 외식")
    book.add_transaction("expense", 120000, "교통", "대중교통/주유")
    print(book.format_report())
