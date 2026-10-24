from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    rememberMe: bool | None = True


class LoginResponse(BaseModel):
    requires2FA: bool
    tempToken: str | None = None
    user: dict[str, Any] | None = None


class TwoFactorVerifyRequest(BaseModel):
    tempToken: str | None = None
    code: str
    method: Literal["totp", "recovery"] = "totp"
    setup: bool | None = False


class MessageUpdate(BaseModel):
    isRead: bool | None = None
    isStarred: bool | None = None
    folder: Literal["inbox", "archive", "trash"] | None = None


class AccountUpdate(BaseModel):
    displayName: str | None = None
    preferences: dict[str, Any] | None = None


class ChangePasswordRequest(BaseModel):
    currentPassword: str
    newPassword: str = Field(min_length=10)


class CreateMailboxRequest(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    domain: str
    customerId: str | None = None
    status: str | None = None


class BulkMailboxRequest(BaseModel):
    count: int = Field(ge=1, le=100)
    prefix: str = Field(min_length=1, max_length=32)
    domain: str
    useRandom: bool = True


class CreateCustomerRequest(BaseModel):
    email: EmailStr
    displayName: str = ""
    password: str | None = Field(default=None, min_length=10)
    sendInvitation: bool = True


class UpdateCustomerStatusRequest(BaseModel):
    status: Literal["active", "suspended"]


class UpdateMailboxRequest(BaseModel):
    customerId: str | None = None
    status: str | None = None
    is_active: bool | None = None


class CreateInvitationRequest(BaseModel):
    mailboxId: str
    customerEmail: EmailStr


class AcceptInvitationRequest(BaseModel):
    password: str = Field(min_length=10)


class Setup2FAVerify(BaseModel):
    code: str
    setup: bool = True
