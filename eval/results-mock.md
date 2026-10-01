## Extraction eval

Provider: `mock` · model: `mock-heuristic-v1` · cases: 15 · reference date: 2026-09-28

| Field | Accuracy |
| --- | --- |
| date | 100% |
| sleepHours | 93% |
| energy | 87% |
| mood | 67% |
| symptoms | 73% |
| **overall (field-level)** | **84%** |

Symptoms precision 100% · recall 76% · corrective retries 1/15 · hard failures (422) 0/15

<details><summary>Per case</summary>

| Case | date | sleepHours | energy | mood | symptoms | Attempts |
| --- | --- | --- | --- | --- | --- | --- |
| 01-basic | ✓ | ✓ | ✓ | ✗ | ✓ | 1 |
| 02-yesterday | ✓ | ✓ | ✓ | ✗ | ✗ | 1 |
| 03-scale-10 | ✓ | ✓ | ✓ | ✓ | ✓ | 2 |
| 04-negation | ✓ | ✓ | ✓ | ✓ | ✓ | 1 |
| 05-cold | ✓ | ✓ | ✓ | ✗ | ✓ | 1 |
| 06-explicit-date | ✓ | ✓ | ✓ | ✓ | ✓ | 1 |
| 07-weekday | ✓ | ✓ | ✗ | ✓ | ✓ | 1 |
| 08-half-hours | ✓ | ✓ | ✓ | ✓ | ✓ | 1 |
| 09-colloquial | ✓ | ✓ | ✗ | ✓ | ✗ | 1 |
| 10-minimal | ✓ | ✓ | ✓ | ✓ | ✓ | 1 |
| 11-not-great | ✓ | ✓ | ✓ | ✗ | ✓ | 1 |
| 12-fever | ✓ | ✓ | ✓ | ✗ | ✗ | 1 |
| 13-range | ✓ | ✗ | ✓ | ✓ | ✓ | 1 |
| 14-mixed-negation | ✓ | ✓ | ✓ | ✓ | ✓ | 1 |
| 15-day-month | ✓ | ✓ | ✓ | ✓ | ✗ | 1 |

</details>
