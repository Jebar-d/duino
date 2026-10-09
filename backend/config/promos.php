<?php

declare(strict_types=1);

class PromoExpiredException extends RuntimeException
{
}

function parsePromoDateTime(string $value): DateTimeImmutable
{
    $value = trim($value);
    if (
        !preg_match(
            '/^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})?)?$/D',
            $value
        )
    ) {
        throw new InvalidArgumentException('A promo date and time are required.');
    }

    try {
        $dateTime = new DateTimeImmutable($value, new DateTimeZone('Asia/Manila'));
        $errors = DateTimeImmutable::getLastErrors();
        if ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0)) {
            throw new InvalidArgumentException('Invalid promo date and time.');
        }
        return $dateTime->setTimezone(new DateTimeZone('Asia/Manila'));
    } catch (InvalidArgumentException $e) {
        throw $e;
    } catch (Exception $e) {
        throw new InvalidArgumentException('Invalid promo date and time.', 0, $e);
    }
}

function promoDateTimeForDatabase(DateTimeImmutable $dateTime): string
{
    return $dateTime
        ->setTimezone(new DateTimeZone('Asia/Manila'))
        ->format('Y-m-d H:i:s');
}

function promoDateTimeForResponse(?string $dateTime): ?string
{
    if ($dateTime === null || $dateTime === '' || str_starts_with($dateTime, '0000-00-00')) {
        return null;
    }

    try {
        return parsePromoDateTime($dateTime)->format(DateTimeInterface::ATOM);
    } catch (InvalidArgumentException) {
        return null;
    }
}

function promoExpirationStatus(array $promo, ?DateTimeImmutable $now = null): string
{
    $timezone = new DateTimeZone('Asia/Manila');
    $now = $now?->setTimezone($timezone) ?? new DateTimeImmutable('now', $timezone);
    if (!empty($promo['valid_until'])) {
        if (str_starts_with((string) $promo['valid_until'], '0000-00-00')) {
            return 'expired';
        }
        try {
            if ($now >= parsePromoDateTime((string) $promo['valid_until'])) {
                return 'expired';
            }
        } catch (InvalidArgumentException) {
            return 'expired';
        }
    }
    if (!empty($promo['valid_from']) && $now < parsePromoDateTime((string) $promo['valid_from'])) {
        return 'scheduled';
    }
    if (
        ($promo['max_uses'] ?? null) !== null
        && (int) $promo['max_uses'] > 0
        && (int) ($promo['used_count'] ?? 0) >= (int) $promo['max_uses']
    ) {
        return 'used_up';
    }

    return 'active';
}
