#include <emscripten/bind.h>
#include <vector>
#include <string>
#include <sstream>
#include <cctype>
#include <algorithm>

using namespace emscripten;
using namespace std;

// Helper: convert string to lowercase
string to_lower(string s) {
    transform(s.begin(), s.end(), s.begin(), ::tolower);
    return s;
}

// Helper: split string into words, keeping indices
vector<pair<string, size_t>> split_words(const string& text) {
    vector<pair<string, size_t>> words;
    size_t pos = 0, start = 0;
    while (pos < text.size()) {
        while (pos < text.size() && isspace(text[pos])) ++pos;
        start = pos;
        while (pos < text.size() && !isspace(text[pos])) ++pos;
        if (start < pos)
            words.emplace_back(text.substr(start, pos - start), start);
    }
    return words;
}

// Main matcher
val find_matches(const string& text, const string& word1, int gap, const string& word2) {
    // Convert search words to lowercase
    string lower_word1 = to_lower(word1);
    string lower_word2 = to_lower(word2);
    
    auto words = split_words(text);
    vector<val> matches;
    
    for (size_t i = 0; i < words.size(); ++i) {
        // Convert current word to lowercase for comparison
        if (to_lower(words[i].first) == lower_word1) {
            for (size_t j = i + 1; j < words.size() && j <= i + gap + 1; ++j) {
                if (to_lower(words[j].first) == lower_word2) {
                    size_t start = words[i].second;
                    size_t end = words[j].second + words[j].first.size();
                    val match = val::object();
                    match.set("start", start);
                    match.set("end", end);
                    matches.push_back(match);
                }
            }
        }
    }
    return val::array(matches);
}

EMSCRIPTEN_BINDINGS(my_module) {
    emscripten::function("find_matches", &find_matches);
} 