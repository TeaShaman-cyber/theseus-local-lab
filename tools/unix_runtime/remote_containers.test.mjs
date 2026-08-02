import test from "node:test";
import assert from "node:assert/strict";
import { parseContainerRows } from "./remote_containers.mjs";

test("parses bounded docker ps JSON rows", () => {
  const rows = parseContainerRows('{"Names":"gramps-web-grampsweb-1","Image":"gramps","Status":"Up 2 minutes","Ports":"127.0.0.1:5000->5000/tcp"}\n');
  assert.deepEqual(rows, [{ name: "gramps-web-grampsweb-1", image: "gramps", status: "Up 2 minutes", ports: "127.0.0.1:5000->5000/tcp" }]);
});

test("ignores malformed container rows", () => {
  assert.deepEqual(parseContainerRows("not-json\n"), []);
});
