import { supabase, isSupabaseConfigured } from "./supabaseClient";

export const PENDING_CONVERSATION_KEY = "nagrikai_pending_reopen_conversation";
export const START_NEW_CONVERSATION_KEY = "nagrikai_start_new_conversation";

export const activeConversationKey = (userId) =>
  `nagrikai_active_ai_conversation_${userId}`;

export async function getAuthenticatedUser() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;
  if (!data?.user) throw new Error("Please sign in to access AI conversations.");

  return data.user;
}

function toDatabaseMessage(message, conversationId, userId) {
  return {
    conversation_id: conversationId,
    user_id: userId,
    role: message.role,
    text_en: message.textEn || "",
    text_hi: message.textHi || "",
    active_lang: message.activeLang === "hi" ? "hi" : "en",
    is_voice_note: Boolean(message.isVoiceNote),
    transcript: message.transcript || null,
    duration_seconds: Math.max(0, Number(message.duration) || 0),
    actions: Array.isArray(message.actions) ? message.actions : []
  };
}

export async function saveConversationTurn({
  conversationId,
  user,
  userMessage,
  assistantMessage
}) {
  if (!user?.id) {
    throw new Error("Authenticated user is required to save conversations.");
  }

  let currentId = conversationId;

  if (!currentId) {
    const { data, error } = await supabase
      .from("ai_conversations")
      .insert({
        user_id: user.id,
        title: "New conversation",
        category: "Civic Assistance",
        language: userMessage.activeLang === "hi" ? "Hindi" : "English"
      })
      .select("id")
      .single();

    if (error) throw error;
    currentId = data.id;
  }

  const rows = [
    toDatabaseMessage(userMessage, currentId, user.id),
    toDatabaseMessage(assistantMessage, currentId, user.id)
  ];

  const { error: messageError } = await supabase
    .from("ai_conversation_messages")
    .insert(rows);

  if (messageError) throw messageError;

  const { error: updateError } = await supabase
    .from("ai_conversations")
    .update({
      language: userMessage.activeLang === "hi" ? "Hindi" : "English"
    })
    .eq("id", currentId)
    .eq("user_id", user.id);

  if (updateError) throw updateError;

  return currentId;
}

export async function loadOwnConversation(conversationId, userId) {
  const { data: conversation, error: conversationError } = await supabase
    .from("ai_conversations")
    .select("id, user_id, title, category, language, created_at, updated_at")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (conversationError) throw conversationError;
  if (!conversation) return null;

  const { data: messages, error: messagesError } = await supabase
    .from("ai_conversation_messages")
    .select("id, conversation_id, role, text_en, text_hi, active_lang, is_voice_note, transcript, duration_seconds, actions, created_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (messagesError) throw messagesError;

  return {
    conversation,
    messages: (messages || []).map((message) => ({
      id: message.id,
      role: message.role,
      textEn: message.text_en,
      textHi: message.text_hi,
      activeLang: message.active_lang,
      isVoiceNote: message.is_voice_note,
      transcript: message.transcript,
      duration: message.duration_seconds,
      actions: message.actions || [],
      timestamp: new Date(message.created_at).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit"
      })
    }))
  };
}

export async function loadOwnConversations(userId) {
  const { data: conversations, error: conversationError } = await supabase
    .from("ai_conversations")
    .select("id, user_id, title, category, language, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (conversationError) throw conversationError;

  const ids = (conversations || []).map((item) => item.id);

  if (ids.length === 0) {
    return { conversations: [], messages: [] };
  }

  const { data: messages, error: messagesError } = await supabase
    .from("ai_conversation_messages")
    .select("id, conversation_id, role, text_en, text_hi, active_lang, is_voice_note, transcript, duration_seconds, actions, created_at")
    .eq("user_id", userId)
    .in("conversation_id", ids)
    .order("created_at", { ascending: true });

  if (messagesError) throw messagesError;

  return {
    conversations: conversations || [],
    messages: messages || []
  };
}

export async function deleteOwnConversations(userId) {
  const { error } = await supabase
    .from("ai_conversations")
    .delete()
    .eq("user_id", userId);

  if (error) throw error;
}
