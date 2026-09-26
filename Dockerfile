# Multi-stage Dockerfile otimizado para deploy no Render
FROM node:20-alpine AS runner

WORKDIR /app

# Variáveis de ambiente de produção
ENV NODE_ENV=production
ENV PORT=3000

# Instala dependências do sistema necessárias se houver compilação nativa
RUN apk add --no-cache libc6-compat

# Copia manifestos de dependência
COPY package.json package-lock.json* bun.lock* ./

# Instala dependências (incluindo devDependencies necessárias para o build do Vite e tsx)
RUN npm install

# Copia código-fonte do projeto
COPY . .

# Executa o build da aplicação frontend Vite
RUN npm run build

# Porta configurada para o Render (o Render injeta dinamicamente $PORT em runtime)
EXPOSE 3000

# Inicia o servidor full-stack (Express + APIs + SPA estática compilada)
CMD ["npm", "start"]
