//! Native boundary for the macOS menu-bar item. App behavior lives in core.ts.

const std = @import("std");
const runner = @import("runner");
const native_sdk = @import("native_sdk");
pub const core = @import("core.generated.zig");

pub const panic = std.debug.FullPanic(native_sdk.debug.capturePanic);
pub const Model = core.Model;
pub const Msg = core.Msg;

const Adapter = native_sdk.TsUiApp(core);
const App = Adapter.App;
const canvas_label = "main-canvas";
const shell_views = [_]native_sdk.ShellView{
    .{ .label = canvas_label, .kind = .gpu_surface, .fill = true, .role = "Sarvam translator widget", .accessibility_label = "Sarvam Translate", .gpu_backend = .metal, .gpu_pixel_format = .bgra8_unorm, .gpu_present_mode = .timer, .gpu_alpha_mode = .@"opaque", .gpu_color_space = .srgb, .gpu_vsync = true },
};
const shell_windows = [_]native_sdk.ShellWindow{.{
    .label = "main",
    .title = "Sarvam Translate",
    .width = 460,
    .height = 680,
    .restore_state = false,
    .close_policy = .hide,
    .views = &shell_views,
}};
const shell_scene: native_sdk.ShellConfig = .{ .windows = &shell_windows };
pub const app_markup = @embedFile("app.native");

const tray_items = [_]native_sdk.TrayMenuItem{
    .{ .id = 1, .label = "Open Translator", .command = "sarvam.open" },
    .{ .separator = true },
    .{ .id = 2, .label = "Quit Sarvam Translate", .command = "sarvam.quit" },
};

pub fn main(init: std.process.Init) !void {
    var options: Adapter.Options = .{
        .name = "sarvam-translate",
        .scene = shell_scene,
        .canvas_label = canvas_label,
        .markup = .{ .source = app_markup, .watch_path = "src/app.native", .io = init.io },
        .theme = comptime runner.manifestThemePack(),
        .theme_accent = comptime runner.manifestThemeAccent(),
        .status_item = .{ .icon_path = "assets/sarvam-logo.png", .tooltip = "Sarvam Translate", .items = &tray_items },
    };
    if (comptime @hasDecl(core, "commandMsg")) options.on_command = core.commandMsg;

    const app_state = try Adapter.create(std.heap.page_allocator, .{}, options);
    defer app_state.destroy();

    try runner.runWithOptions(app_state.app(), .{
        .app_name = "sarvam-translate",
        .window_title = "Sarvam Translate",
        .bundle_id = "dev.native_sdk.sarvam-translate",
        .icon_path = "assets/sarvam-logo.png",
        .default_frame = native_sdk.geometry.RectF.init(0, 0, 460, 680),
        .restore_state = false,
        .js_window_api = false,
        .security = .{ .permissions = &.{ native_sdk.security.permission_command, native_sdk.security.permission_view, native_sdk.security.permission_credentials }, .navigation = .{ .allowed_origins = &.{ "zero://inline", "zero://app" } } },
    }, init);
}
