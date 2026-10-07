-- These roles carry no platform mutation privilege merely by existing.
-- Separate migration: new enum values must be committed before use.
alter type platform.platform_role_type add value if not exists 'PLATFORM_SALES';
alter type platform.platform_role_type add value if not exists 'PLATFORM_CONTRACTS';
alter type platform.platform_role_type add value if not exists 'PLATFORM_ONBOARDING';
