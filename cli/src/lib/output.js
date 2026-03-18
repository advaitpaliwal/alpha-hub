export function output(data, humanFormatter, opts) {
  if (opts?.json) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    humanFormatter(data);
  }
}

export function info(msg) {
  process.stderr.write(msg + '\n');
}

export function error(msg, opts) {
  if (opts?.json) {
    console.log(JSON.stringify({ error: msg }));
  } else {
    process.stderr.write(`Error: ${msg}\n`);
  }
  process.exit(1);
}
