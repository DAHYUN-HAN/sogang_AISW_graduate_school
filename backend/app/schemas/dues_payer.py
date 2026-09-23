from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


PaymentScope = Literal["ALL", "ONCE", "UNPAID"]


class DuesPaymentWriteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    payment_scope: PaymentScope
    once_board_id: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def validate_scope(self):
        if self.payment_scope == "ONCE" and self.once_board_id is None:
            raise ValueError("ONCE requires once_board_id")
        if self.payment_scope != "ONCE" and self.once_board_id is not None:
            raise ValueError("once_board_id is allowed only for ONCE")
        return self
