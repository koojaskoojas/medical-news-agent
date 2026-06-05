import re
import hashlib


def clean_html(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&[a-zA-Z]+;", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def clean_text(text: str) -> str:
    if not text:
        return ""
    text = clean_html(text)
    text = re.sub(r"[^\w\s.,!?;:()\-–—\"'%$€£¥°]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def compute_hash(title: str, content: str = "") -> str:
    raw = f"{title.lower().strip()}{content[:200].lower().strip()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def truncate(text: str, max_chars: int = 8000) -> str:
    if not text:
        return ""
    return text[:max_chars] if len(text) > max_chars else text
