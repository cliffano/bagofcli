// A TypeScript consumer of bagofcli, type-checked under strict mode by
// test-integration/typescript.js. It's only type-checked, never executed.
//
// The @ts-expect-error lines must keep failing to type-check, if the
// declarations get loosened (e.g. to any), tsc reports them as unused.
import bag from "bagofcli";
import type { Actions, CommandArg } from "bagofcli";

// Action handler argument type is inferred from Actions.
const actions: Actions = {
  commands: {
    serve: {
      action: (command) => {
        const args: string[] = command.args;
        const name: string = command.name();
        // Option values are unknown, so they have to be narrowed before use.
        const port =
          typeof command.port === "string" ? Number(command.port) : 8080;
        console.log(args, name, port);
      },
    },
    deploy: {
      // An async action handler is accepted too.
      action: async (command: CommandArg) => {
        await Promise.resolve(command.env);
      },
    },
  },
};
bag.command(import.meta.dirname, actions);
bag.command(import.meta.dirname, actions, { commandFile: "commands.json" });
bag.command(import.meta.dirname);

// Action handler typed with a looser argument type, as in oag-mcp's
// hand-written shim, is accepted too.
type CommandArgs = Record<string, unknown> & { args?: string[] };
const serve = (args: CommandArgs): void => {
  console.log(args.args);
};
bag.command(import.meta.dirname, { commands: { serve: { action: serve } } });

bag.exit();
bag.exit(null);
bag.exit(new Error("some error"));
bag.exit({ error: "some error" });

const exitWithResult = bag.exitCb<string>(undefined, (result) =>
  console.log(result.toUpperCase()),
);
exitWithResult(null, "some result");
exitWithResult(new Error("some error"));

bag.logStepHeading("Some heading", { labels: ["some label"] });
bag.logStepItemSuccess("Some success");
bag.logStepItemWarning("Some warning");
bag.logStepItemError("Some error");

bag.exec("ls", false, (err, result) => {
  console.log(err?.message, result?.message);
});
bag.execAndCollect("ls", true, (err, stdOutOutput, stdErrOutput) => {
  console.log(err, stdOutOutput.trim(), stdErrOutput.trim());
});
bag.spawn("ls", ["-l"], (err, exitCode) => {
  console.log(err, exitCode);
});
bag.lookupConfig(["someKey"], { prompt: false }, (err, result) => {
  console.log(err, result.someKey);
});
const content: Buffer = bag.lookupFile("somefile");
const files: string[] = bag.files(["lib"], { match: "\\.js$" });
console.log(content, files);

// @ts-expect-error base must be a string
bag.command(123);

// @ts-expect-error action handler must be a function
bag.command(import.meta.dirname, { commands: { serve: { action: "serve" } } });

bag.command(import.meta.dirname, {
  commands: {
    serve: {
      // @ts-expect-error option values are unknown, so they can't be used without narrowing
      action: (command) => command.port.toUpperCase(),
    },
  },
});

// @ts-expect-error commandFile must be a string
bag.command(import.meta.dirname, actions, { commandFile: true });

// @ts-expect-error labels must be an array of strings
bag.logStepHeading("Some heading", { labels: "some label" });

// @ts-expect-error success callback result type must match exitCb's type parameter
bag.exitCb<number>(undefined, (result: string) => console.log(result));
