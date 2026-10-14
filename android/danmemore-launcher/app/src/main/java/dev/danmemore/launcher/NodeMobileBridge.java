package dev.danmemore.launcher;

public final class NodeMobileBridge {
    private static final boolean loaded;
    private static final Throwable loadError;
    static {
        boolean ok; Throwable error = null;
        try { System.loadLibrary("node"); System.loadLibrary("danmemore_node_bridge"); ok = true; }
        catch (Throwable value) { ok = false; error = value; }
        loaded = ok; loadError = error;
    }
    private NodeMobileBridge() {}
    public static boolean isLoaded() { return loaded; }
    public static String loadErrorMessage() { return loadError == null ? "" : loadError.toString(); }
    public static native int startNodeWithArguments(String[] arguments);
}

