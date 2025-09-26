# Cloud-Based LLM-Powered Threat Intelligence Dashboard

A sophisticated threat intelligence platform that leverages Large Language Models and cloud computing to automate the collection, analysis, and visualization of cybersecurity threat data.

## 🚀 Features

- **Automated Data Collection**: Web scraping from 50+ threat intelligence sources
- **AI-Powered Analysis**: Google Gemini API integration for natural language processing
- **Real-time Dashboard**: Interactive visualizations with live threat monitoring
- **Natural Language Querying**: Conversational interface for threat intelligence exploration
- **Cloud-Native Architecture**: Scalable AWS S3-based data storage
- **Comprehensive Security**: Role-based access control and data encryption

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Data Sources   │───▶│  Data Pipeline  │───▶│   Dashboard     │
│                 │    │                 │    │                 │
│ • Web Scraping  │    │ • AWS S3        │    │ • Real-time UI  │
│ • RSS Feeds     │    │ • Processing    │    │ • Analytics     │
│ • APIs          │    │ • Gemini LLM    │    │ • Alerts        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🛠️ Technology Stack

- **Backend**: Python, Flask/FastAPI, SQLAlchemy
- **Frontend**: Vue.js/React, Chart.js, WebSockets
- **AI/ML**: Google Gemini API, Natural Language Processing
- **Cloud**: AWS S3, Lambda, CloudWatch
- **Database**: PostgreSQL, Redis
- **Infrastructure**: Docker, GitHub Actions

## 📋 Prerequisites

- Python 3.11+
- Node.js 18+
- Docker & Docker Compose
- AWS Account with S3 access
- Google Cloud Account with Gemini API access

## ⚡ Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/Varun0737/Cloud-based-LLM-powered-threat-intelligence-Dashboard.git
   cd Cloud-based-LLM-powered-threat-intelligence-Dashboard
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

3. **Start with Docker Compose**
   ```bash
   docker-compose up -d
   ```

4. **Access the dashboard**
   - Open http://localhost:5000 in your browser

## 📖 Documentation

- [📚 Full Documentation](docs/README.md)
- [🚀 Deployment Guide](docs/DEPLOYMENT.md)
- [🔧 API Reference](docs/API.md)
- [👥 Contributing](docs/CONTRIBUTING.md)

## 🧪 Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=backend

# Run specific test suite
pytest backend/tests/unit/
```

## 📊 Project Status

- **Phase 1**: Foundation & Setup ✅
- **Phase 2**: Data Collection & Processing 🚧
- **Phase 3**: LLM Integration ⏳
- **Phase 4**: Dashboard Development ⏳
- **Phase 5**: Testing & Documentation ⏳

## 👨‍💻 Team

- **Varun Reddy Shyamala** - [shyamala002@gannon.edu](mailto:shyamala002@gannon.edu)
- **Mounish Nizampatnam** - [izampat001@gannon.edu](mailto:nizampat001@gannon.edu)

## 🎓 Academic Context

This project is part of the Cybersecurity program at Gannon University, supervised by the Department of Computer Science. The project demonstrates the integration of modern AI technologies with cybersecurity practices to address real-world threat intelligence challenges.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Gannon University Department of Computer Science
- Google Cloud Platform for Gemini API access
- Amazon Web Services for cloud infrastructure
- Open source cybersecurity community for threat intelligence sources

## 📞 Support

For questions, issues, or contributions, please:
1. Check the [documentation](docs/)
2. Search existing [issues](https://github.com/Varun0737/Cloud-based-LLM-powered-threat-intelligence-Dashboard/issues)
3. Create a new issue if needed
4. Contact the development team

---

**⭐ Star this repository if you find it useful!**
