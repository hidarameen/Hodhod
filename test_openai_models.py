#!/usr/bin/env python3
"""
Test all OpenAI models one by one to check availability and token limits
"""
import asyncio
import os
import sys
from dotenv import load_dotenv

load_dotenv()

# List of all available OpenAI models to test
OPENAI_MODELS_TO_TEST = [
    # Latest models (highest priority)
    {"name": "gpt-4o", "max_tokens": 4096, "description": "GPT-4o (Latest)"},
    {"name": "gpt-4o-mini", "max_tokens": 4096, "description": "GPT-4o Mini"},
    {"name": "gpt-4-turbo", "max_tokens": 4096, "description": "GPT-4 Turbo"},
    {"name": "gpt-4-turbo-preview", "max_tokens": 4096, "description": "GPT-4 Turbo Preview"},
    {"name": "gpt-4", "max_tokens": 4096, "description": "GPT-4"},
    {"name": "gpt-3.5-turbo", "max_tokens": 4096, "description": "GPT-3.5 Turbo"},
    # Vision models
    {"name": "gpt-4-vision", "max_tokens": 4096, "description": "GPT-4 Vision"},
    # Legacy models
    {"name": "text-davinci-003", "max_tokens": 2048, "description": "Text Davinci 003"},
]

async def test_model(model_name: str, max_tokens: int, api_key: str) -> dict:
    """Test a single OpenAI model"""
    try:
        from openai import AsyncOpenAI
        
        client = AsyncOpenAI(api_key=api_key)
        
        # Use a short prompt to minimize tokens
        test_prompt = "Say 'OK' in one word."
        
        print(f"\n✅ Testing {model_name}...")
        print(f"   Max tokens: {max_tokens}")
        
        try:
            response = await client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": test_prompt}],
                max_tokens=max_tokens,
                temperature=0.7,
                timeout=10
            )
            
            content = response.choices[0].message.content if response.choices else "No response"
            usage = response.usage if hasattr(response, 'usage') else None
            
            return {
                "model": model_name,
                "status": "✅ WORKING",
                "response": content[:100],
                "tokens_used": f"prompt={usage.prompt_tokens}, completion={usage.completion_tokens}" if usage else "N/A",
                "error": None
            }
        except Exception as e:
            error_msg = str(e)
            if "404" in error_msg or "not found" in error_msg.lower():
                return {
                    "model": model_name,
                    "status": "❌ NOT FOUND",
                    "response": None,
                    "tokens_used": None,
                    "error": "Model not available in your account"
                }
            elif "context length" in error_msg.lower() or "tokens" in error_msg.lower():
                return {
                    "model": model_name,
                    "status": "⚠️ TOKEN LIMIT ISSUE",
                    "response": None,
                    "tokens_used": None,
                    "error": error_msg[:100]
                }
            elif "rate limit" in error_msg.lower() or "429" in error_msg:
                return {
                    "model": model_name,
                    "status": "⏱️ RATE LIMITED",
                    "response": None,
                    "tokens_used": None,
                    "error": "Rate limit exceeded"
                }
            else:
                return {
                    "model": model_name,
                    "status": "❌ ERROR",
                    "response": None,
                    "tokens_used": None,
                    "error": error_msg[:150]
                }
    except Exception as e:
        return {
            "model": model_name,
            "status": "❌ FAILED",
            "response": None,
            "tokens_used": None,
            "error": str(e)[:150]
        }


async def main():
    """Test all models"""
    api_key = os.getenv("OPENAI_API_KEY")
    
    if not api_key:
        print("❌ OPENAI_API_KEY not found in environment variables")
        sys.exit(1)
    
    print("=" * 70)
    print("🧪 OpenAI Models Availability Test")
    print("=" * 70)
    
    results = []
    
    for model_info in OPENAI_MODELS_TO_TEST:
        result = await test_model(model_info["name"], model_info["max_tokens"], api_key)
        results.append(result)
        await asyncio.sleep(0.5)  # Small delay between requests
    
    # Print summary
    print("\n" + "=" * 70)
    print("📊 Test Results Summary")
    print("=" * 70)
    
    working = []
    not_found = []
    errors = []
    
    for result in results:
        model = result["model"]
        status = result["status"]
        
        print(f"\n{status} {model}")
        if result["error"]:
            print(f"   Error: {result['error']}")
        if result["tokens_used"]:
            print(f"   Tokens: {result['tokens_used']}")
        if result["response"]:
            print(f"   Response: {result['response']}")
        
        if "WORKING" in status:
            working.append(model)
        elif "NOT FOUND" in status:
            not_found.append(model)
        else:
            errors.append(model)
    
    print("\n" + "=" * 70)
    print("📈 Summary")
    print("=" * 70)
    print(f"✅ Working Models ({len(working)}): {', '.join(working) if working else 'None'}")
    print(f"❌ Not Found ({len(not_found)}): {', '.join(not_found) if not_found else 'None'}")
    print(f"⚠️  Errors ({len(errors)}): {', '.join(errors) if errors else 'None'}")
    
    if working:
        print(f"\n🎯 Recommended model to use: {working[0]}")
    
    print("\n" + "=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
