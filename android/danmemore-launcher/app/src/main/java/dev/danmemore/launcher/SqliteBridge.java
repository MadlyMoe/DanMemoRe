package dev.danmemore.launcher;

import android.database.Cursor;
import android.database.CursorWindow;
import android.database.sqlite.SQLiteCursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteStatement;
import org.json.JSONArray;
import org.json.JSONObject;

public final class SqliteBridge {
    private static SQLiteDatabase database;
    private SqliteBridge() {}

    public static synchronized String call(String operation, String sql, String encoded) throws Exception {
        if (operation.equals("open")) {
            if (database != null) throw new IllegalStateException("Database already open");
            database = SQLiteDatabase.openOrCreateDatabase(sql, null); return "null";
        }
        if (database == null) throw new IllegalStateException("Database is closed");
        if (operation.equals("close")) { database.close(); database = null; return "null"; }
        if (operation.equals("exec")) {
            for (String statement : sql.split(";")) if (!statement.trim().isEmpty()) {
                if (statement.trim().toUpperCase(java.util.Locale.ROOT).startsWith("PRAGMA")) {
                    try (Cursor cursor = database.rawQuery(statement, null)) { cursor.moveToFirst(); }
                } else database.execSQL(statement);
            }
            return "null";
        }
        JSONArray values = new JSONArray(encoded);
        if (operation.equals("all")) {
            String[] args = new String[values.length()];
            for (int i = 0; i < args.length; i++) args[i] = values.isNull(i) ? null : values.get(i).toString();
            JSONArray rows = new JSONArray();
            try (Cursor cursor = database.rawQuery(sql, args)) {
                if (cursor instanceof SQLiteCursor && android.os.Build.VERSION.SDK_INT >= 28)
                    ((SQLiteCursor) cursor).setWindow(new CursorWindow("DanMemoRe SQLite", 64L * 1024 * 1024));
                while (cursor.moveToNext()) {
                    JSONObject row = new JSONObject();
                    for (int i = 0; i < cursor.getColumnCount(); i++) {
                        Object value;
                        switch (cursor.getType(i)) {
                            case Cursor.FIELD_TYPE_NULL: value = JSONObject.NULL; break;
                            case Cursor.FIELD_TYPE_INTEGER: value = cursor.getLong(i); break;
                            case Cursor.FIELD_TYPE_FLOAT: value = cursor.getDouble(i); break;
                            default: value = cursor.getString(i);
                        }
                        row.put(cursor.getColumnName(i), value);
                    }
                    rows.put(row);
                }
            }
            return rows.toString();
        }
        if (!operation.equals("run")) throw new IllegalArgumentException("Unknown database operation");
        try (SQLiteStatement statement = database.compileStatement(sql)) {
            for (int i = 0; i < values.length(); i++) {
                Object value = values.get(i);
                if (value == JSONObject.NULL) statement.bindNull(i + 1);
                else if (value instanceof Float || value instanceof Double) statement.bindDouble(i + 1, ((Number) value).doubleValue());
                else if (value instanceof Number) statement.bindLong(i + 1, ((Number) value).longValue());
                else statement.bindString(i + 1, value.toString());
            }
            return new JSONObject().put("changes", statement.executeUpdateDelete()).toString();
        }
    }
}

