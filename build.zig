//! This build belongs to your app, written once by `native eject`:
//! the `native` CLI stops generating a build graph and
//! drives this file through `zig build` instead, and it will
//! never rewrite it. `addApp` wires the complete standard app
//! build — executable, `zig build run`, `zig build test`, and
//! the -Dplatform/-Dweb-engine/-Dautomation/-Doptimize flags —
//! from the framework's build/app.zig, so a framework upgrade
//! still upgrades your build. Extend from here with
//! `addAppArtifacts` when you need extra sources or steps.

const std = @import("std");
const native_sdk = @import("native_sdk");

pub fn build(b: *std.Build) void {
    const sdk = b.dependency("native_sdk", .{});
    transpileCore(b, sdk);
    native_sdk.addApp(b, sdk, .{ .name = "sarvam-translate", .main = "src/host.zig" });
}

// Native SDK's generated TypeScript runner does not expose a menu-bar status
// item yet. Generate the TS core locally, then let host.zig add that one
// macOS boundary while all application behavior remains in src/core.ts.
fn transpileCore(b: *std.Build, sdk: *std.Build.Dependency) void {
    const runtime_source = sdk.path("packages/core/rt/rt.zig").getPath(b);
    const runtime_copy = std.process.run(b.allocator, b.graph.io, .{
        .argv = &.{ "cp", runtime_source, "src/rt.zig" },
        .stdout_limit = .limited(4096),
        .stderr_limit = .limited(4096),
    }) catch |err| std.debug.panic("could not stage the TypeScript runtime: {s}", .{@errorName(err)});
    defer b.allocator.free(runtime_copy.stdout);
    defer b.allocator.free(runtime_copy.stderr);
    if (runtime_copy.term != .exited or runtime_copy.term.exited != 0) {
        std.debug.panic("could not stage the TypeScript runtime:\n{s}", .{runtime_copy.stderr});
    }

    const result = std.process.run(b.allocator, b.graph.io, .{
        .argv = &.{
            "node",
            sdk.path("build/ts_run.mjs").getPath(b),
            sdk.path("packages/core/src/cli.ts").getPath(b),
            "src/core.ts",
            "-o",
            "src/core.generated.zig",
        },
        .stdout_limit = .limited(64 * 1024),
        .stderr_limit = .limited(64 * 1024),
    }) catch |err| std.debug.panic("could not transpile src/core.ts: {s}", .{@errorName(err)});
    defer b.allocator.free(result.stdout);
    defer b.allocator.free(result.stderr);
    if (result.term != .exited or result.term.exited != 0) {
        std.debug.panic("TypeScript core did not compile:\n{s}", .{result.stderr});
    }
}
