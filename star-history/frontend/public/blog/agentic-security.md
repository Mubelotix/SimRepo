---
title: "Starlet #29 Agentic Security: Open-Source Vulnerability Scanner for AI Systems"
author: "Alexander Myasoedov"
featured: true
featureImage: "/assets/blog/agentic-security/banner.webp"
publishedDate: "2025-03-05T00:00:00.000Z"
description: "Agentic Security is a vulnerability scanner to protect Agent Workflows and LLMs."
---

*This is the twenty-ninth issue of The Starlet List. If you want to prompt your open source project on star-history.dera.page for free, please check out our [announcement](/blog/list-your-open-source-project).*

---

[**Agentic Security**](https://agentic-security.vercel.app/) is an open-source vulnerability scanner designed to protect **Agent Workflows** and **Large Language Models (LLMs)** from jailbreaks, fuzzing, and multimodal attacks. Built for developers, researchers, and security teams, Agentic Security empowers you to **proactively identify and mitigate risks** in AI systems—all within a lightweight, Python-based framework.

Agentic Security is **Apache 2.0-licensed** on GitHub and has already sparked interest in the **AI security community**. Whether you’re securing LLMs or stress-testing APIs, this tool is your go-to for **building safer, more reliable AI deployments**.

---

## 🚨 The Problem: AI Systems Are Vulnerable

As **AI adoption skyrockets, so do the threats**. LLMs face sophisticated attacks:

- **Jailbreaks** that bypass safety guardrails
- **Fuzzing** that exposes edge cases
- **Multimodal exploits** via text, images, or audio

Traditional security tools **aren’t equipped** to handle these risks, leaving **AI systems exposed**. We built **Agentic Security** to **address this gap** after encountering these challenges firsthand in **real-world deployments**.

---

## 🛡️ The Solution: Comprehensive AI Security Testing

Agentic Security brings **cutting-edge tools** to **safeguard your LLMs and agent workflows**:

### 🔍 **Multimodal Attacks** 🖼️🎙️
Test vulnerabilities across **text, images, and audio inputs**.

### 🌀 **Multi-Step Jailbreaks**
Simulate **iterative attack sequences** to uncover **hidden weaknesses**.

### 🧪 **Comprehensive Fuzzing**
Stress-test with **randomized inputs** to catch **unexpected behaviors**.

### 🌐 **API Stress Testing**
Push LLM APIs to their limits with **real-world attack scenarios**.

### 📡 **RL-Based Attacks**
Use **reinforcement learning** to evolve **adaptive probes** against your defenses.

With **seamless CI/CD integration** and a **user-friendly UI**, Agentic Security makes it **easy to secure AI at scale**.

---

## 🎬 Demo

Check out the **live demo** to see **Agentic Security in action**, probing an **LLM with a multimodal attack in under 5 minutes**!

> **🔗 Agentic Security UI**
<img width="100%" alt="booking-screen" src="https://res.cloudinary.com/dq0w2rtm9/image/upload/v1741192668/final_aa9jhb.gif">

---

## 🚀 Why Agentic Security?

✔️ **Open Source:** Freely extendable under **Apache 2.0**.

✔️ **Python-Powered:** No need to juggle languages—just **pure Python**.

✔️ **Scalable:** Handles **thousands of probes efficiently** with minimal setup.

✔️ **CI/CD Ready:** Integrates into **GitHub Actions** for automated scans.

When we **stress-tested an internal LLM** with Agentic Security, we identified a **24.8% failure rate on jailbreak attempts**—well within our **30% threshold**—and **patched it fast**. Now, we’re **sharing this power with you**.

---

## ⚡ Getting Started

Install Agentic Security with one command:

```bash
pip install agentic_security
```

Launch it:

```bash
agentic_security --port=8718 --host=0.0.0.0
```

Or run it as a CI check:

```bash
agentic_security ci
```

See the Quick Start guide for more.


## 🔧 What Can You Build?

- Secure LLM Deployments: Harden chatbots and APIs against attacks.
- Research Tools: Probe cutting-edge models for academic studies.
- Compliance Testing: Align with OWASP Top 10 for AI security.
- Custom Attack Datasets: Extend with your own prompts and modalities.

## 📚 Learn More

[💻 GitHub Repo](https://github.com/msoedov/agentic_security)
[📖 Docs](https://agentic-security.vercel.app/)

🤝 Contribute

We’d love your help! Fork the repo, submit a PR, or join us on Discord to shape the future of AI security. Check the Roadmap for upcoming features like new attack vectors and OWASP integration.


## The Future of Agentic Security

We’re just getting started! Here’s what’s on the horizon:
- **RL-Powered Attacks**: An attacker LLM trained with reinforcement learning to dynamically evolve jailbreaks and outsmart defenses.
- **Massive Dataset Expansion**: Scaling to 100,000+ prompts across text, image, and audio modalities—curated for real-world threats.
- **Daily Attack Updates**: Fresh attack vectors delivered daily, keeping your scans ahead of the curve.
- **Community Modules**: A plug-and-play ecosystem where you can share and deploy custom probes, datasets, and integrations.

Agentic Security is here to make AI safer—one probe at a time. Try it out, and let us know what you think! 🚀