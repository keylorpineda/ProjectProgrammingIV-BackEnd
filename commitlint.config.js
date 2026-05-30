/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Tipos permitidos alineados con el flujo del proyecto
    "type-enum": [
      2,
      "always",
      [
        "feat", // nueva funcionalidad
        "fix", // corrección de bug
        "refactor", // refactor sin cambio funcional
        "test", // añadir o corregir tests
        "docs", // sólo documentación
        "chore", // tareas de mantenimiento (deps, config)
        "perf", // mejora de rendimiento
        "style", // formato, espacios (sin cambio lógico)
        "ci", // cambios en CI/CD
        "revert", // revertir commit anterior
      ],
    ],
    "subject-case": [0, "always", "lower-case"],
    "subject-max-length": [2, "always", 200],
    "header-max-length": [2, "always", 200],
    "body-max-line-length": [1, "always", 200],
  },
};
