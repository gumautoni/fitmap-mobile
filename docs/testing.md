# Estratégia de testes automatizados

Este documento descreve a fundação de testes automatizados do FitMap e os comandos utilizados para validar o backend e o aplicativo mobile durante o desenvolvimento.

## Princípios

Os testes do FitMap devem priorizar:

- comportamento relevante;
- prevenção de regressões;
- regras de negócio;
- fluxos críticos;
- integração com dependências reais quando isso trouxer valor;
- isolamento de dados de teste.

O projeto não busca maximizar métricas de cobertura sem propósito.

Novas funcionalidades críticas devem incluir testes adequados ao risco e ao comportamento introduzido.

## Backend

O backend utiliza:

- pytest;
- FastAPI TestClient;
- PostgreSQL para testes de integração;
- Alembic para validação de migrations.

### Executar todos os testes

Na pasta `backend`:

```bash
uv run pytest
```
