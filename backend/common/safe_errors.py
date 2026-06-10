import os
import re
import logging

logger = logging.getLogger(__name__)

_BEARER_RE = re.compile(r"Bearer\s+\S+", re.I)
_KEY_PARAM_RE = re.compile(r"([?&]key=)[^&\s\"']+", re.I)


def _known_secrets():
    return (
        os.environ.get("LLM_API_KEY", ""),
        os.environ.get("GOOGLE_CLIENT_ID", ""),
    )


def redact_secrets(text):
    if not text:
        return text
    for secret in _known_secrets():
        if secret:
            text = text.replace(secret, "***")
    text = _BEARER_RE.sub("Bearer ***", text)
    text = _KEY_PARAM_RE.sub(r"\1***", text)
    return text


def log_error(message, detail=None):
    if detail is not None:
        logger.error("%s: %s", message, redact_secrets(str(detail)))
    else:
        logger.error(message)
