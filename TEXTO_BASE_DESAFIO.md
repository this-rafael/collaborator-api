# Teste técnico Inmeta - API

### API de Gerenciamento de documentação de colaboradores

Desenvolver uma API RESTful para o gerenciamento do fluxo de documentação de colaboradores. Cada colaborador é vinculado a tipos de documentos específicos que são obrigatórios para envio, e o sistema deve acompanhar quais documentos estão pendentes, enviados e em qual versão se encontram.

Mais do que "fazer funcionar", queremos entender o que você considera código pronto para produção. Decisões de modelagem, separação de responsabilidades, tratamento de erros e clareza valem tanto quanto a correção funcional.

### Prazo

Você tem 7 dias corridos a partir do recebimento deste desafio para entregar.

Não esperamos que você dedique todo esse tempo ao teste, o prazo existe para acomodar sua rotina. Se algo do escopo ficar de fora por decisão consciente de priorização: explique no README o que ficou faltando e por quê. Preferimos um escopo menor bem executado a um escopo maior incompleto e frágil.

### Escopo Funcional

- Cadastro de colaboradores.
- Cadastro de tipos de documentos (CPF, Certidão, ASO, etc.).
- Vinculação e desvinculação de colaboradores a tipos de documentos.
- Envio de documentos (representação lógica apenas, não é necessário o upload do arquivo físico)
- Listagem de documentos pendentes com paginação e filtros.
- Estatísticas gerais, incluindo:
    - Percentual de documentação completa no sistema como um todo (visão global).
    - Tipos de documentos mais frequentemente pendentes.
    - Últimos envios realizados.

> Sobre as estatísticas: deixamos deliberadamente em aberto como expor e estruturar esses dados (endpoint único de dashboard ou endpoints separados, formato da resposta, etc.). Queremos ver sua abordagem de agregação e modelagem das consultas, não um formato pré-definido.
> 

### Requisitos Técnicos

**Versionamento de documentos com histórico**
Um documento pode ser reenviado. O sistema deve manter o histórico de versões, garantindo que apenas a versão mais recente esteja ativa, sem perder as anteriores.

Atomicidade e consistência em operações críticas
Operações que envolvem múltiplas escritas relacionadas devem ser atômicas, ou tudo é persistido, ou nada é.

> Identificar operações do sistema são críticas e tratá-las adequadamente faz parte do desafio.
> 

**Soft delete**
Colaboradores e documentos não podem ser removidos fisicamente. O sistema deve preservar o histórico e a consistência mesmo após uma "remoção", e as remoções devem ser refletidas corretamente em todas as consultas, filtros e estatísticas.

### Tecnologias

- API RESTful com entrada/saída em JSON.
- Node.js com TypeScript.
- Framework à sua escolha (Nest.js, Fastify, TS.ED, Express, ou outro).
- Banco de dados à sua escolha.
- Ferramenta de testes à sua escolha.

Não é necessária autenticação ou autorização. Caso implemente, isso não será avaliado e não deve consumir o foco do desafio.

### Diferenciais (opcionais)

Os itens abaixo não são obrigatórios e a ausência deles não será penalizada. Eles existem para quem quiser ir além e demonstrar profundidade:

- Documentação da API via OpenAPI/Swagger.
- Logs estruturados e/ou um endpoint de health check.
- Testes de integração além dos unitários.
- Tratamento explícito de concorrência: por exemplo, o que acontece se dois reenvios do mesmo documento chegam simultaneamente?
- Qualquer outra decisão que você considere relevante para um ambiente de produção (e que valha a pena justificar no README).

### Restrições

- O projeto deve estar no GitHub.
- Não deve ser feito fork de nenhum outro projeto.
- Apenas o seu usuário deve realizar commits no repositório.
- Esperamos um histórico de commits incremental que demonstre a evolução do sistema, evite um único commit gigante com tudo pronto.

## Como revisamos e o que avaliamos

---

Seu teste será analisado por pelo menos dois de nossos engenheiros. Levamos em consideração seu nível de experiência. Um dos objetivos deste desafio é nos ajudar a identificar o que você considera código pronto para produção.

Os aspectos do seu código que avaliaremos incluem:

- **Arquitetura:** quão clara é a separação entre camadas e responsabilidades?
- **Modularização:** a separação entre módulos é coerente e não gera acoplamento desnecessário?
- **Testes automatizados:** quão completos são os testes automatizados?
- **Modelagem:** os modelos de dados são bem definidos e estruturados?
- **Tratamento de Erros:** como você trata os erros da sua aplicação?
- **Correção**: a aplicação faz o que foi solicitado? Se houver algo faltando, o README explica o motivo?
- **Qualidade do código**: o código é simples, fácil de entender e de fácil manutenção? Há algum code smell ou outros sinais de alerta? O estilo de codificação é consistente em toda a base de código?
- **Escolhas técnicas**: as escolhas de bibliotecas, bancos de dados, arquitetura etc. parecem apropriadas para a aplicação escolhida?
- **Commits:** definem bem a alteração realizada, são bem divididos e demonstram a evolução do sistema?