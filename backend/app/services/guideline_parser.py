import re
import uuid


def parse_guidelines(extracted_text: str) -> list:

    if not extracted_text or not extracted_text.strip():
        return []

    # Find numbered headings such as:
    # Rule 01 — Logo placement
    # Rule 02 — Logo integrity

    pattern = re.compile(
        r"^[ \t]*Rule[ \t]+(\d{1,3})"
        r"[ \t]*[—–:-][ \t]*(.+?)[ \t]*$",
        re.IGNORECASE | re.MULTILINE
    )

    matches = list(pattern.finditer(extracted_text))

    rules = []
    seen_numbers = set()

    for index, match in enumerate(matches):

        rule_number = int(match.group(1))
        category = match.group(2).strip()

        if rule_number in seen_numbers:
            continue

        seen_numbers.add(rule_number)

        start = match.end()

        if index + 1 < len(matches):
            end = matches[index + 1].start()
        else:
            end = len(extracted_text)

        block = extracted_text[start:end]

        # Exclude document sections after the final rule.
        section_end = re.search(
    r"^[ \t]*(?:"
    r"Sampled-frame limitation|"
    r"Speech-recognition uncertainty|"
    r"Not assessable|"
    r"Violation evidence|"
    r"Human decision|"
    r"5\.\s*Suggested test scenarios|"
    r"4\.\s*Evidence and review protocol|"
    r"Suggested test scenarios|"
    r"End of document"
    r")[ \t]*$",
    block,
    re.IGNORECASE | re.MULTILINE
)



        if section_end:
         block = block[:section_end.start()]

        # Extract severity.
        severity_match = re.search(
            r"Severity\s*:\s*(critical|high|medium|low)",
            block,
            re.IGNORECASE
        )

        severity = (
            severity_match.group(1).lower()
            if severity_match
            else "medium"
        )

        # Extract check type.
        check_match = re.search(
            r"Check\s*type\s*:\s*([a-zA-Z_]+)",
            block,
            re.IGNORECASE
        )

        check_type = (
            check_match.group(1).lower()
            if check_match
            else "human_verification"
        )

        # Remove severity and check-type metadata.
        block = re.sub(
            r"Severity\s*:\s*(critical|high|medium|low)",
            "",
            block,
            flags=re.IGNORECASE
        )

        block = re.sub(
            r"Check\s*type\s*:\s*[a-zA-Z_]+",
            "",
            block,
            flags=re.IGNORECASE
        )

        # Remove page headers and footers.
        block = re.sub(
            r"---\s*Page\s+\d+\s*---",
            " ",
            block,
            flags=re.IGNORECASE
        )

        block = re.sub(
            r"NOVASOUND\s*\|\s*BRAND GOVERNANCE GUIDELINES\s*\|\s*TEST DOCUMENT",
            " ",
            block,
            flags=re.IGNORECASE
        )

        rule_text = re.sub(
            r"\s+",
            " ",
            block
        ).strip()

        if not rule_text:
            continue

        rules.append({
            "id": str(uuid.uuid4()),
            "rule_number": rule_number,
            "category": category,
            "rule": rule_text,
            "severity": severity,
            "check_type": check_type,
            "enabled": True
        })

    return sorted(
        rules,
        key=lambda item: item["rule_number"]
    )