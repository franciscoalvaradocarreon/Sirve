# syntax=docker/dockerfile:1
# ============================================================================
# SIRVE-P en un solo contenedor.
#
# El jar lleva el front de React dentro (classpath:/static), así que no hay
# dos servidores ni CORS que coordinar: un solo origen, un solo proceso.
#
# Tres etapas para que la imagen final no lleve Node, Maven ni el código
# fuente: solo un JRE y el WAR.
# ============================================================================


# ---------- Etapa 1: compilar el frontend ----------
FROM node:22-alpine AS front
WORKDIR /front

# Primero los manifiestos: si el código cambia pero no las dependencias,
# Docker reutiliza esta capa y se salta el npm ci.
COPY FrontendReact/package.json FrontendReact/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY FrontendReact/ ./

# vite build directo, sin pasar por "npm run build": ese ejecuta antes tsc -b
# y un error de tipos en un archivo ajeno al cambio frenaría el despliegue.
# El chequeo de tipos vive en el CI.
RUN node node_modules/vite/bin/vite.js build


# ---------- Etapa 2: compilar el backend con el front dentro ----------
FROM maven:3.9-eclipse-temurin-21 AS back
WORKDIR /build

COPY BackendJava/pom.xml ./
RUN --mount=type=cache,target=/root/.m2 mvn -B -q dependency:go-offline

COPY BackendJava/src ./src

# El front compilado entra en el classpath del jar. Se borra antes para que no
# queden archivos de una construcción anterior.
RUN rm -rf ./src/main/resources/static
COPY --from=front /front/dist/ ./src/main/resources/static/

RUN --mount=type=cache,target=/root/.m2 mvn -B -q clean package -DskipTests


# ---------- Etapa 3: ejecución ----------
FROM eclipse-temurin:21-jre-alpine

# Usuario sin privilegios: si alguien entra por un fallo de la aplicación, no
# es root dentro del contenedor.
RUN addgroup -S sirve && adduser -S sirve -G sirve

WORKDIR /app
COPY --from=back /build/target/sirve.jar ./app.jar

USER sirve
EXPOSE 8080

# La JVM respeta el límite de memoria del contenedor (mem_limit en compose).
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75 -XX:+UseContainerSupport"

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
