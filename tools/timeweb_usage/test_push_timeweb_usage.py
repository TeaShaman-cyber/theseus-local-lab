import importlib.util
from pathlib import Path

path = Path(__file__).with_name('push_timeweb_usage.py')
spec = importlib.util.spec_from_file_location('push_timeweb_usage', path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_full_payload_emits_rubles():
    payload = {'finances': {'balance': 898.33, 'total_balance': 898.33, 'monthly_cost': 80,
                            'hourly_cost': 0.11, 'hours_left': 8219, 'total_paid': 3800}}
    lines = module.build_lines(payload, 100)
    assert 'metric=read_ok value=1' in lines
    assert 'metric=balance_rub value=898.3300' in lines
    assert 'metric=monthly_cost_rub value=80.0000' in lines


def test_missing_field_is_unknown_not_zero():
    lines = module.build_lines({'finances': {'balance': 5.0}}, 100)
    assert 'metric=balance_rub value=5.0000' in lines
    assert 'metric=monthly_cost_rub_known value=0' in lines
    assert not any(line.startswith('metric=monthly_cost_rub ') for line in lines)


def test_broken_payload_is_not_success():
    lines = module.build_lines({'unexpected': True}, 100)
    assert lines == ['metric=sample_timestamp_seconds value=100', 'metric=read_ok value=0']


def test_nan_is_rejected():
    lines = module.build_lines({'finances': {'balance': float('nan')}}, 100)
    assert 'metric=balance_rub_known value=0' in lines
