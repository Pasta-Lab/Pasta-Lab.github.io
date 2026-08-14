# Pasta Lab projects

Each project is one `##` heading followed by a short key/value block, then `---`,
then the description in plain Markdown. Copy an existing block to add a project.

Keys, all optional except `tagline`:

    tagline    one sentence, shown under the title
    status     Active | Ongoing | Archived
    year       shown as the project's date stamp
    tags       comma separated
    links      markdown links, space separated
    people     comma separated names
    partners   comma separated organisation names

This paragraph is ignored by the site. Only `##` blocks are read.

## ReverseEngBench (previously SRE-Bench)

tagline: A realistic, contamination-free benchmark for agentic reverse engineering.
status: Active
year: 2026
tags: AI Security, Reverse Engineering, Benchmarks, Agents
links: [Paper](https://arxiv.org/abs/2608.11469) [Leaderboard](https://www.vals.ai/benchmarks/reverse_eng)
people: Jeremy Spence, Nicholas Assaderaghi, Jinhao Zhu, Nikil Ravi, Raluca Ada Popa, Guannan Wei, Yangruibo Ding, Zhuo Zhang
partners: Vals AI, UC Berkeley

---

AI agents are getting good at security work when they can read the source. The
software that matters most to security, though, ships as binaries: malware,
firmware, proprietary applications. Working on those means reverse engineering,
recovering what a program means before you can reason about it at all.

Benchmarking that skill is harder than it looks. If a binary was built from
source the model has already read, the agent can recognise the program instead
of analysing it, and the score measures memory rather than capability. Existing
benchmarks either leak in this way or stay far below the size and the
anti-analysis hardening of real targets.

SRE-Bench is built from scratch to close both gaps. Reverse engineering experts
spent over 5,000 hours writing 19 private programs averaging 16.9K lines, then
layered 44 in-house anti-analysis primitives on top, producing 262 binary
instances and 1,572 deterministically graded tasks. Across five frontier models
the task is far from solved: the strongest scores 61.4% per instance and fully
solves 31.5% of them. Agents also fail differently from people, staying oddly
insensitive to compiler optimisation and static linking.
