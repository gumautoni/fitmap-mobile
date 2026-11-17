from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException

from fitmap.api.observability import REQUEST_ID_HEADER


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


class ApiError(Exception):
    def __init__(
        self,
        *,
        status_code: int,
        code: str,
        message: str,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.headers = headers


def register_exception_handlers(application: FastAPI) -> None:
    @application.exception_handler(Exception)
    async def handle_unexpected_error(
        request: Request,
        _exc: Exception,
    ) -> PlainTextResponse:
        request_id = getattr(request.state, "request_id", None)
        headers = {REQUEST_ID_HEADER: request_id} if isinstance(request_id, str) else None

        return PlainTextResponse(
            "Internal Server Error",
            status_code=500,
            headers=headers,
        )

    @application.exception_handler(ApiError)
    async def handle_api_error(_request: Request, exc: ApiError) -> JSONResponse:
        payload = ErrorResponse(
            error=ErrorDetail(
                code=exc.code,
                message=exc.message,
            )
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=payload.model_dump(),
            headers=exc.headers,
        )

    @application.exception_handler(RequestValidationError)
    async def handle_validation_error(
        _request: Request,
        _exc: RequestValidationError,
    ) -> JSONResponse:
        payload = ErrorResponse(
            error=ErrorDetail(
                code="request_validation_error",
                message="Request validation failed.",
            )
        )
        return JSONResponse(
            status_code=422,
            content=payload.model_dump(),
        )

    @application.exception_handler(StarletteHTTPException)
    async def handle_http_error(
        _request: Request,
        exc: StarletteHTTPException,
    ) -> JSONResponse:
        message = exc.detail

        payload = ErrorResponse(
            error=ErrorDetail(
                code=f"http_{exc.status_code}",
                message=message,
            )
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=payload.model_dump(),
        )
